import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import "./index.css";
import { MantineProvider } from "@mantine/core";
import { theme } from "./theme";

ReactDOM.render(
	<MantineProvider theme={theme}>
		<App />
	</MantineProvider>,
	document.getElementById("root")
);
