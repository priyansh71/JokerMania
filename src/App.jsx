import "./App.css";
import { Button, Text, Title } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import twitterLogo from "./assets/twitter-logo.svg";
import joker from "./assets/joker.svg";
import { Image, Container } from "@mantine/core";
import * as anchor from "@project-serum/anchor";
import { clusterApiUrl } from "@solana/web3.js";
import { DEFAULT_TIMEOUT } from "./CandyMachine/connection";
import { ConnectionProvider } from "@solana/wallet-adapter-react";
import CandyMachine from "./CandyMachine/Home";

const TWITTER_HANDLE = "priyansh_71";
const TWITTER_LINK = `https://twitter.com/${TWITTER_HANDLE}`;

const getCandyMachineId = () => {
	try {
		const REACT_APP_CANDY_MACHINE_ID =
			process.env.REACT_APP_CANDY_MACHINE_ID;
		return new anchor.web3.PublicKey(REACT_APP_CANDY_MACHINE_ID);
	} catch (e) {
		console.log("Failed to construct CandyMachineId", e);
		return undefined;
	}
};

let error = undefined;
const candyMachineId = getCandyMachineId();
const network = process.env.REACT_APP_SOLANA_NETWORK;
const rpcHost = anchor.web3.clusterApiUrl(network);
const connection = new anchor.web3.Connection(rpcHost);

function App() {
	const [walletAddress, setWalletAddress] = useState(null);
	const checkIfWalletIsConnected = async () => {
		try {
			const { solana } = window;

			if (solana) {
				if (!solana.isPhantom) {
					console.log("Please install Phantom Wallet.");
				}

				const response = await solana.connect({ onlyIfTrusted: true });
				console.log(
					"Connected with Public Key:",
					response.publicKey.toString()
				);
				setWalletAddress(response.publicKey.toString());
			} else {
				alert("Solana object not found! Get a Phantom Wallet 👻");
			}
		} catch (error) {
			console.log(error);
		}
	};
	const connectWallet = async () => {
		try {
			const { solana } = window;

			if (solana) {
				const response = await solana.connect();
				console.log(
					"Connected with Public Key:",
					response.publicKey.toString()
				);
				setWalletAddress(response.publicKey.toString());
			} else {
				alert("Solana object not found, check your console!");
				console.log(
					"Please visit https://chrome.google.com/webstore/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa?hl=en or https://addons.mozilla.org/en-US/firefox/addon/phantom-app/ depending on your browser to install the Phantom Wallet."
				);
			}
		} catch (err) {
			console.log(err);
		}
	};
	const endpoint = useMemo(() => clusterApiUrl(network), []);
	useEffect(() => {
		const onLoad = async () => {
			await checkIfWalletIsConnected();
		};
		window.addEventListener("load", onLoad);
		return () => window.removeEventListener("load", onLoad);
	}, []);

	return (
		<ConnectionProvider endpoint={endpoint}>
			<div className="container">
				<Image
					src={joker}
					alt="joker"
					width={100}
					className="image-container"
				/>

				<Title
					order={1}
					style={{
						color: "#fff",
					}}
					className="header-container"
				>
					JokerMania
				</Title>

				{!walletAddress ? (
					<Button
						onClick={connectWallet}
						variant="gradient"
						gradient={{ from: "purple", to: "maroon", deg: 90 }}
						size="lg"
						weight={700}
						style={{
							color: "white",
							width: "400px",
							marginLeft: "auto",
							marginRight: "auto",
							marginTop: "100px",
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
					<CandyMachine
						candyMachineId={candyMachineId}
						connection={connection}
						txTimeout={DEFAULT_TIMEOUT}
						rpcHost={rpcHost}
						network={network}
						error={error}
						walletAddress={window.solana}
					/>
				)}
				<Container className="footer-container">
					<Image
						alt="Twitter Logo"
						className="twitter-logo"
						src={twitterLogo}
						width={50}
					/>
					<Text>
						<a
							href={TWITTER_LINK}
							target="_blank"
							rel="noreferrer noopener"
							style={{
								textDecoration: "none",
								color: "white",
								fontFamily: "Montserrat",
							}}
						>
							@{TWITTER_HANDLE}
						</a>
					</Text>
				</Container>
			</div>
		</ConnectionProvider>
	);
}

export default App;
