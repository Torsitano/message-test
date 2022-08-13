import { CustomMessageConstruct } from './../constructs/MessageConstruct'
import { Stack, StackProps } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { BuildConfig } from '../buildUtils'



export class MessageStack extends Stack {
    constructor ( scope: Construct, id: string, buildConfig: BuildConfig, props?: StackProps ) {
        super( scope, id, props )


        // // Increase memory and timeout as required for process
        // const processingLambda = new NodejsFunction( this, 'processingLambda', {
        //     entry: './src/lambda/processMessage.ts',
        //     handler: 'handler',
        //     runtime: Runtime.NODEJS_16_X,
        //     memorySize: 128,
        //     bundling: {
        //         sourceMap: true
        //     },
        //     functionName: `${buildConfig.appName}-processing-lambda`,
        //     description: 'Processes objects put into the S3 Bucket for inbound payloads',
        //     timeout: Duration.seconds( 10 ),
        //     environment: {
        //         DEBUG_LOGS: 'true',
        //         FAILURE_TEST: 'true'
        //     }
        // } )

        new CustomMessageConstruct( this, 'MessageDeployment', {
            environment: buildConfig.environment,
            appName: buildConfig.appName,
            processingLambdaCode: './src/lambda/processMessage.ts',
            awsAccountId: buildConfig.awsAccountId
        } )

    }
}
