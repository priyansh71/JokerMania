import { useCallback, useEffect, useMemo, useState } from "react";
import * as anchor from "@project-serum/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import {
	awaitTransactionSignatureConfirmation,
	CANDY_MACHINE_PROGRAM,
	createAccountsForMint,
	getCandyMachineState,
	getCollectionPDA,
	mintOneToken,
} from "./candy-machine";
import { getAtaForMint } from "./utils";
import { MintButton } from "./MintButton";
import { GatewayProvider } from "@civic/solana-gateway-react";
import { sendTransaction } from "./connection";
import { Button, Container, Stack, Title } from "@mantine/core";

const CandyMachine = props => {
	const [isUserMinting, setIsUserMinting] = useState(false);
	const [candyMachine, setCandyMachine] = useState();
	const [isActive, setIsActive] = useState(false);
	const [itemsRemaining, setItemsRemaining] = useState();
	const [isWhitelistUser, setIsWhitelistUser] = useState(false);
	const [isPresale, setIsPresale] = useState(false);
	const [isValidBalance, setIsValidBalance] = useState(false);
	const [needTxnSplit, setNeedTxnSplit] = useState(true);
	const [setupTxn, setSetupTxn] = useState();

	const rpcUrl = props.rpcHost;
	const wallet = useWallet();
	const cluster = props.network;
	const anchorWallet = useMemo(() => {
		if (
			!wallet ||
			!wallet.publicKey ||
			!wallet.signAllTransactions ||
			!wallet.signTransaction
		) {
			return;
		}

		return {
			publicKey: wallet.publicKey,
			signAllTransactions: wallet.signAllTransactions,
			signTransaction: wallet.signTransaction,
		};
	}, [wallet]);

	const refreshCandyMachineState = useCallback(
		async (commitment = "confirmed") => {
			if (!anchorWallet) {
				return;
			}
			if (props.error !== undefined) {
				console.log("Error:", props.error);
				return;
			}

			const connection = new Connection(props.rpcHost, commitment);

			if (props.candyMachineId) {
				try {
					const cndy = await getCandyMachineState(
						anchorWallet,
						props.candyMachineId,
						connection
					);
					let active = cndy?.state.goLiveDate
						? cndy?.state.goLiveDate.toNumber() <
						  new Date().getTime() / 1000
						: false;
					let presale = false;

					// duplication of state to make sure we have the right values!
					let isWLUser = false;
					let userPrice = cndy.state.price;

					// whitelist mint?
					if (cndy?.state.whitelistMintSettings) {
						// is it a presale mint?
						if (
							cndy.state.whitelistMintSettings.presale &&
							(!cndy.state.goLiveDate ||
								cndy.state.goLiveDate.toNumber() >
									new Date().getTime() / 1000)
						) {
							presale = true;
						}

						// retrieves the whitelist token
						const mint = new anchor.web3.PublicKey(
							cndy.state.whitelistMintSettings.mint
						);
						const token = (
							await getAtaForMint(mint, anchorWallet.publicKey)
						)[0];

						try {
							const balance =
								await connection.getTokenAccountBalance(token);
							isWLUser = parseInt(balance.value.amount) > 0;
							// only whitelist the user if the balance > 0
							setIsWhitelistUser(isWLUser);

							if (cndy.state.isWhitelistOnly) {
								active = isWLUser && (presale || active);
							}
						} catch (e) {
							setIsWhitelistUser(false);
							// no whitelist user, no mint
							if (cndy.state.isWhitelistOnly) {
								active = false;
							}
							console.log(
								"There was a problem fetching whitelist token balance"
							);
							console.log(e);
						}
					}
					userPrice = isWLUser ? userPrice : cndy.state.price;

					if (cndy?.state.tokenMint) {
						// retrieves the SPL token
						const mint = new anchor.web3.PublicKey(
							cndy.state.tokenMint
						);
						const token = (
							await getAtaForMint(mint, anchorWallet.publicKey)
						)[0];
						try {
							const balance =
								await connection.getTokenAccountBalance(token);

							const valid = new anchor.BN(
								balance.value.amount
							).gte(userPrice);

							// only allow user to mint if token balance >  the user if the balance > 0
							setIsValidBalance(valid);
							active = active && valid;
						} catch (e) {
							setIsValidBalance(false);
							active = false;

							console.log(
								"There was a problem fetching SPL token balance"
							);
							console.log(e);
						}
					} else {
						const balance = new anchor.BN(
							await connection.getBalance(anchorWallet.publicKey)
						);
						const valid = balance.gte(userPrice);
						setIsValidBalance(valid);
						active = active && valid;
					}

					// datetime to stop the mint?
					if (cndy?.state.endSettings?.endSettingType.date) {
						if (
							cndy.state.endSettings.number.toNumber() <
							new Date().getTime() / 1000
						) {
							active = false;
						}
					}
					// amount to stop the mint?
					if (cndy?.state.endSettings?.endSettingType.amount) {
						const limit = Math.min(
							cndy.state.endSettings.number.toNumber(),
							cndy.state.itemsAvailable
						);
						if (cndy.state.itemsRedeemed < limit) {
							setItemsRemaining(limit - cndy.state.itemsRedeemed);
						} else {
							setItemsRemaining(0);
							cndy.state.isSoldOut = true;
						}
					} else {
						setItemsRemaining(cndy.state.itemsRemaining);
					}

					if (cndy.state.isSoldOut) {
						active = false;
					}

					const [collectionPDA] = await getCollectionPDA(
						props.candyMachineId
					);
					const collectionPDAAccount =
						await connection.getAccountInfo(collectionPDA);

					setIsActive((cndy.state.isActive = active));
					setIsPresale((cndy.state.isPresale = presale));
					setCandyMachine(cndy);

					const txnEstimate =
						892 +
						(!!collectionPDAAccount && cndy.state.retainAuthority
							? 182
							: 0) +
						(cndy.state.tokenMint ? 66 : 0) +
						(cndy.state.whitelistMintSettings ? 34 : 0) +
						(cndy.state.whitelistMintSettings?.mode?.burnEveryTime
							? 34
							: 0) +
						(cndy.state.gatekeeper ? 33 : 0) +
						(cndy.state.gatekeeper?.expireOnUse ? 66 : 0);

					setNeedTxnSplit(txnEstimate > 1230);
				} catch (e) {
					if (e instanceof Error) {
						if (
							e.message ===
							`Account does not exist ${props.candyMachineId}`
						) {
							console.log(
								`Couldn't fetch candy machine state from candy machine with address: ${props.candyMachineId}`
							);
						} else if (
							e.message.startsWith(
								"failed to get info about account"
							)
						) {
							console.log(
								`Couldn't fetch candy machine state with rpc: ${props.rpcHost}!`
							);
						}
					}
					console.log(e);
				}
			} else {
				console.log("Look at your Candy Machine ID.");
			}
		},
		[anchorWallet, props.candyMachineId, props.error, props.rpcHost]
	);

	const onMint = async (beforeTransactions = [], afterTransactions = []) => {
		try {
			setIsUserMinting(true);
			document.getElementById("#identity")?.click();
			if (wallet.connected && candyMachine?.program && wallet.publicKey) {
				let setupMint;
				if (needTxnSplit && setupTxn === undefined) {
					console.log("Please sign account setup txn");
					setupMint = await createAccountsForMint(
						candyMachine,
						wallet.publicKey
					);
					let status = { err: true };
					if (setupMint.transaction) {
						status = await awaitTransactionSignatureConfirmation(
							setupMint.transaction,
							props.txTimeout,
							props.connection,
							true
						);
					}
					if (status && !status.err) {
						setSetupTxn(setupMint);
						console.log(
							"Setup transaction succeeded! Please sign minting transaction"
						);
					} else {
						console.log("Mint failed! Please try again!");
						setIsUserMinting(false);
						return;
					}
				} else {
					console.log("Please sign minting transaction");
				}

				const mintResult = await mintOneToken(
					candyMachine,
					wallet.publicKey,
					beforeTransactions,
					afterTransactions,
					setupMint ?? setupTxn
				);

				let status = { err: true };
				let metadataStatus = null;
				if (mintResult) {
					status = await awaitTransactionSignatureConfirmation(
						mintResult.mintTxId,
						props.txTimeout,
						props.connection,
						true
					);

					metadataStatus =
						await candyMachine.program.provider.connection.getAccountInfo(
							mintResult.metadataKey,
							"processed"
						);
					console.log("Metadata status: ", !!metadataStatus);
				}

				if (status && !status.err && metadataStatus) {
					// manual update since the refresh might not detect
					// the change immediately
					const remaining = itemsRemaining - 1;
					setItemsRemaining(remaining);
					setIsActive((candyMachine.state.isActive = remaining > 0));
					candyMachine.state.isSoldOut = remaining === 0;
					setSetupTxn(undefined);
					refreshCandyMachineState("processed");
				} else if (status && !status.err) {
					console.log(
						"Mint likely failed! Anti-bot SOL 0.01 fee potentially charged! Check the explorer to confirm the mint failed and if so, make sure you are eligible to mint before trying again."
					);
					refreshCandyMachineState();
				} else {
					console.log("Mint failed! Please try again!");
					refreshCandyMachineState();
				}
			}
		} catch (error) {
			let message = error.msg || "Minting failed! Please try again!";
			if (!error.msg) {
				if (!error.message) {
					message = "Transaction timeout! Please try again.";
				} else if (error.message.indexOf("0x137")) {
					message = `SOLD OUT!`;
				} else if (error.message.indexOf("0x135")) {
					message = `Insufficient funds to mint. Please fund your wallet.`;
				}
			} else {
				if (error.code === 311) {
					console.log(error);
					message = `SOLD OUT!`;
					window.location.reload();
				} else if (error.code === 312) {
					message = `Minting period hasn't started yet.`;
				}
			}

			console.log(message);
			refreshCandyMachineState();
		} finally {
			setIsUserMinting(false);
		}
	};

	useEffect(() => {
		refreshCandyMachineState();
	}, [
		anchorWallet,
		props.candyMachineId,
		props.connection,
		refreshCandyMachineState,
	]);

	useEffect(() => {
		(function loop() {
			setTimeout(() => {
				refreshCandyMachineState();
				loop();
			}, 20000);
		})();
	}, [refreshCandyMachineState]);

	return (
		<Container
			style={{
				display: "flex",
				background: "transparent",
				backdropFilter: "blur(1px)",
				backdropContrast: "90%",
				width: "500px",
				margin: "auto",
				padding: "1rem",
				borderRadius: "6px",
				boxShadow: "0px 0px 10px rgba(0,0,0,0.5)",
				border: "1px solid #e6e6e6",
				height: "200px",
				flexDirection: "column",
			}}
		>
			{!wallet.connected ? (
				<Button
					variant="gradient"
					gradient={{ from: "purple", to: "maroon", deg: 90 }}
					size="lg"
					weight={700}
					style={{
						color: "white",
						width: "400px",
						margin: "auto",
						paddingLeft: "5rem",
						paddingRight: "5rem",
						fontSize: "1.3rem",
						fontWeight: "100",
						fontFamily: "Montserrat",
						cursor: "pointer",
					}}
				>
					Connect Wallet
				</Button>
			) : (
				<>
					{candyMachine && (
						<Stack
							style={{
								display: "flex",
								flexDirection: "row",
								textAlign: "center",
								justifyContent: "center",
								alignItems: "center",
								marginLeft: "auto",
								marginRight: "auto",
								color: "aliceblue",
								fontFamily: "Montserrat",
								marginTop: "30px",
								marginBottom: "30px",
							}}
						>
							<Title
								order={1}
								style={{
									fontFamily: "Montserrat",
									color: "#deedeefa",
								}}
							>
								NFTs Remaining :{" "}
							</Title>

							<Title
								order={1}
								style={{
									fontFamily: "Montserrat",
									color: "#deedeeab",
								}}
							>
								{itemsRemaining}/
								{candyMachine.state.itemsAvailable}
							</Title>
						</Stack>
					)}
					<div>
						{candyMachine?.state.isActive &&
						candyMachine?.state.gatekeeper &&
						wallet.publicKey &&
						wallet.signTransaction ? (
							<GatewayProvider
								wallet={{
									publicKey:
										wallet.publicKey ||
										new PublicKey(CANDY_MACHINE_PROGRAM),
									//@ts-ignore
									signTransaction: wallet.signTransaction,
								}}
								gatekeeperNetwork={
									candyMachine?.state?.gatekeeper
										?.gatekeeperNetwork
								}
								clusterUrl={rpcUrl}
								cluster={cluster}
								handleTransaction={async transaction => {
									setIsUserMinting(true);
									const userMustSign =
										transaction.signatures.find(sig =>
											sig.publicKey.equals(
												wallet.publicKey
											)
										);
									if (userMustSign) {
										console.log(
											"Please sign one-time Civic Pass issuance"
										);
										try {
											transaction =
												await wallet.signTransaction(
													transaction
												);
										} catch (e) {
											console.log(
												"User cancelled signing"
											);
											setTimeout(
												() => window.location.reload(),
												2000
											);
											setIsUserMinting(false);
											throw e;
										}
									} else {
										console.log("Refreshing Civic Pass");
									}
									try {
										await sendTransaction(
											props.connection,
											wallet,
											transaction,
											[],
											true,
											"confirmed"
										);
										console.log("Please sign minting");
									} catch (e) {
										console.log(
											"Solana dropped the transaction, please try again"
										);
										console.error(e);
										setTimeout(
											() => window.location.reload(),
											2000
										);
										setIsUserMinting(false);
										throw e;
									}
									await onMint();
								}}
								broadcastTransaction={false}
								options={{ autoShowModal: false }}
							>
								<MintButton
									candyMachine={candyMachine}
									isMinting={isUserMinting}
									setIsMinting={val => setIsUserMinting(val)}
									onMint={onMint}
									isActive={
										isActive ||
										(isPresale &&
											isWhitelistUser &&
											isValidBalance)
									}
								/>
							</GatewayProvider>
						) : (
							<MintButton
								candyMachine={candyMachine}
								isMinting={isUserMinting}
								setIsMinting={val => setIsUserMinting(val)}
								onMint={onMint}
								isActive={
									isActive ||
									(isPresale &&
										isWhitelistUser &&
										isValidBalance)
								}
							/>
						)}
					</div>
				</>
			)}
		</Container>
	);
};

export default CandyMachine;
