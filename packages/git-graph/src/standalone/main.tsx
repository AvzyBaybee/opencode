/* @refresh reload */
import "./styles.css"
import { render } from "solid-js/web"
import { StandaloneApp } from "./app"

const root = document.getElementById("root")
if (!root) throw new Error("Missing #root")
render(() => <StandaloneApp />, root)
const boot = document.getElementById("boot")
if (boot) boot.remove()
