import { CustomMessageConstruct } from './../constructs/MessageConstruct'
import { Duration, Stack, StackProps } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { BuildConfig } from '../buildUtils'



export class MessageStack extends Stack {
    readonly messageConstruct: CustomMessageConstruct

    constructor ( scope: Construct, id: string, buildConfig: BuildConfig, props?: StackProps ) {
        super( scope, id, props )

        this.messageConstruct = new CustomMessageConstruct( this, 'MessageDeployment', {
            environment: buildConfig.environment,
            appName: buildConfig.appName,
            processingLambdaCode: './src/lambda/processMessage.ts',
            awsAccountId: buildConfig.awsAccountId,
            lambdaOverrides: {
                memorySize: 256,
                timeout: Duration.seconds( 60 )
            }
        } )

    }
}
