import { Construct } from "constructs"
import { TerraformStack } from "cdktf"
import { AwsProvider } from '@cdktf/provider-aws'

export class MessageStack extends TerraformStack {
    constructor ( scope: Construct, name: string ) {
        super( scope, name )


        new AwsProvider( this, 'AWS', {
            region: 'us-east-1'
        } )

        // define resources here
    }
}