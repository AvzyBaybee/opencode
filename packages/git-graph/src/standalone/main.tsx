/* @refresh reload */
import { render } from "solid-js/web"
import { StandaloneApp } from "./app"
import "./styles.css"

const root = document.getElementById("root")
if (!root) throw new Error("Missing #root")
render(() => <StandaloneApp />, root)
