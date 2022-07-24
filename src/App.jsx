import "./App.css";
import { Text, Title } from "@mantine/core";
import { useMemo } from "react";
import twitterLogo from "./assets/twitter-logo.svg";
import joker from "./assets/joker.svg";
import { Image, Container } from "@mantine/core";
import * as anchor from "@project-serum/anchor";
import { clusterApiUrl } from "@solana/web3.js";
import {
	getPhantomWallet,
	getSlopeWallet,
	getSolflareWallet,
	getSolletExtensionWallet,
	getSolletWallet,
} from "@solana/wallet-adapter-wallets";
import { DEFAULT_TIMEOUT } from "./CandyMachine/connection";
import {
	ConnectionProvider,
	WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletDialogProvider } from "@solana/wallet-adapter-material-ui";
import CandyMachine from "./CandyMachine/index";

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
const network = "devnet";
const rpcHost = anchor.web3.clusterApiUrl("devnet");
const connection = new anchor.web3.Connection(rpcHost);

function App() {
	const endpoint = useMemo(() => clusterApiUrl(network), []);

	const wallets = useMemo(
		() => [
			getPhantomWallet(),
			getSolflareWallet(),
			getSlopeWallet(),
			getSolletWallet({ network }),
			getSolletExtensionWallet({ network }),
		],
		[]
	);

	return (
		<ConnectionProvider endpoint={endpoint}>
			<WalletProvider wallets={wallets} autoConnect>
				<WalletDialogProvider>
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
						<CandyMachine
							candyMachineId={candyMachineId}
							connection={connection}
							txTimeout={DEFAULT_TIMEOUT}
							rpcHost={rpcHost}
							network={network}
							error={error}
						/>
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
				</WalletDialogProvider>
			</WalletProvider>
		</ConnectionProvider>
	);
}

export default App;
