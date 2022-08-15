import { App } from "cdktf"
import { MessageStack } from './stacks/MessageStack'


const app = new App()

new MessageStack( app, "MessageStackCdkTf" )
app.synth()
