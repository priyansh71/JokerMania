import { GatewayStatus, useGateway } from "@civic/solana-gateway-react";
import { useEffect, useState, useRef } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

import {
	findGatewayToken,
	getGatewayTokenAddressForOwnerAndGatekeeperNetwork,
	onGatewayTokenChange,
	removeAccountChangeListener,
} from "@identity.com/solana-gateway-ts";
import { Button } from "@mantine/core";

export const MintButton = ({
	onMint,
	candyMachine,
	isMinting,
	setIsMinting,
	isActive,
}) => {
	const wallet = useWallet();
	const connection = useConnection();
	const [verified, setVerified] = useState(false);
	const { requestGatewayToken, gatewayStatus } = useGateway();
	const [webSocketSubscriptionId, setWebSocketSubscriptionId] = useState(-1);
	const [clicked, setClicked] = useState(false);

	const getMintButtonContent = () => {
		if (candyMachine?.state.isSoldOut) {
			return "SOLD OUT";
		} else if (isMinting) {
			return "MINTING...";
		} else if (
			candyMachine?.state.isPresale ||
			candyMachine?.state.isWhitelistOnly
		) {
			return "WHITELIST MINT";
		}

		return "MINT NFT";
	};

	useEffect(() => {
		const mint = async () => {
			await removeAccountChangeListener(
				connection.connection,
				webSocketSubscriptionId
			);
			await onMint();

			setClicked(false);
			setVerified(false);
		};
		if (verified && clicked) {
			mint();
		}
	}, [
		verified,
		clicked,
		connection.connection,
		onMint,
		webSocketSubscriptionId,
	]);

	const minting = async () => {
		if (candyMachine?.state.isActive && candyMachine?.state.gatekeeper) {
			const network =
				candyMachine.state.gatekeeper.gatekeeperNetwork.toBase58();
			if (network === "ignREusXmGrscGNUesoU9mxfds9AiYTezUKex2PsZV6") {
				if (gatewayStatus === GatewayStatus.ACTIVE) {
					await onMint();
				} else {
					// setIsMinting(true);
					await requestGatewayToken();
				}
			} else if (
				network === "ttib7tuX8PTWPqFsmUFQTj78MbRhUmqxidJRDv4hRRE" ||
				network === "tibePmPaoTgrs929rWpu755EXaxC7M3SthVCf6GzjZt"
			) {
				setClicked(true);
				const gatewayToken = await findGatewayToken(
					connection.connection,
					wallet.publicKey,
					candyMachine.state.gatekeeper.gatekeeperNetwork
				);

				if (gatewayToken?.isValid()) {
					await onMint();
				} else {
					window.open(
						`https://verify.encore.fans/?gkNetwork=${network}`,
						"_blank"
					);

					const gatewayTokenAddress =
						await getGatewayTokenAddressForOwnerAndGatekeeperNetwork(
							wallet.publicKey,
							candyMachine.state.gatekeeper.gatekeeperNetwork
						);

					setWebSocketSubscriptionId(
						onGatewayTokenChange(
							connection.connection,
							gatewayTokenAddress,
							() => setVerified(true),
							"confirmed"
						)
					);
				}
			} else {
				setClicked(false);
				throw new Error(`Unknown Gatekeeper Network: ${network}`);
			}
		} else {
			await onMint();
			setClicked(false);
		}
	};

	const previousGatewayStatus = usePrevious(gatewayStatus);
	useEffect(() => {
		const fromStates = [
			GatewayStatus.NOT_REQUESTED,
			GatewayStatus.REFRESH_TOKEN_REQUIRED,
		];
		const invalidToStates = [...fromStates, GatewayStatus.UNKNOWN];
		if (
			fromStates.find(state => previousGatewayStatus === state) &&
			!invalidToStates.find(state => gatewayStatus === state)
		) {
			setIsMinting(true);
		}
	}, [setIsMinting, previousGatewayStatus, gatewayStatus]);

	return (
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
			onClick={minting}
			disabled={isMinting || !isActive}
		>
			{getMintButtonContent()}
		</Button>
	);
};

function usePrevious(value) {
	const ref = useRef();
	useEffect(() => {
		ref.current = value;
	}, [value]);
	return ref.current;
}