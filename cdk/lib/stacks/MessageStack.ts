import { CustomMessageConstruct } from './../constructs/MessageConstruct'
import { Duration, Stack, StackProps } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { BuildConfig } from '../buildUtils'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Runtime } from 'aws-cdk-lib/aws-lambda'


export class MessageStack extends Stack {
    constructor ( scope: Construct, id: string, buildConfig: BuildConfig, props?: StackProps ) {
        super( scope, id, props )


        // Increase memory and timeout as required for process
        const processingLambda = new NodejsFunction( this, 'processingLambda', {
            entry: './src/lambda/processMessage.ts',
            handler: 'handler',
            runtime: Runtime.NODEJS_16_X,
            memorySize: 128,
            bundling: {
                sourceMap: true
            },
            functionName: `${buildConfig.appName}-processing-lambda`,
            description: 'Processes objects put into the S3 Bucket for inbound payloads',
            timeout: Duration.seconds( 10 ),
            environment: {
                DEBUG_LOGS: 'true',
                FAILURE_TEST: 'true'
            }
        } )

        new CustomMessageConstruct( this, 'MessageDeployment', {
            environment: buildConfig.environment,
            appName: buildConfig.appName,
            processingLambda: processingLambda
        } )

    }
}
