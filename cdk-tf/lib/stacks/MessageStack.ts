import { CustomMessageConstruct } from './../constructs/MessageConstruct'
import { Construct } from "constructs"
import { TerraformStack } from "cdktf"
import { AwsProvider } from '@cdktf/provider-aws'

export class MessageStack extends TerraformStack {
    constructor ( scope: Construct, name: string ) {
        super( scope, name )


        new AwsProvider( this, 'AWS', {
            region: 'us-east-1'
        } )

        new CustomMessageConstruct( this, 'MessageDeployment', {
            environment: 'Prod',
            appName: 'MessageTestTf',
            processingLambdaCode: './dist/processMessage/',
            awsAccountId: '698852667105',
            lambdaOverrides: {
                memorySize: 256,
                timeout: 60
            }
        } )

        // define resources here
    }
}