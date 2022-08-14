import { BuildConfig } from './../lib/buildUtils'
import { Template } from 'aws-cdk-lib/assertions'
import { App, CfnElement, Duration, IResource, Stack, StackProps } from 'aws-cdk-lib'
import { CustomMessageConstruct } from '../lib/constructs/MessageConstruct'
import { Construct } from 'constructs'



function getLogicalId( stack: Stack, resource: IResource ) {
    return stack.getLogicalId( resource.node.findChild( 'Resource' ) as CfnElement )
}


export class TestMessageStack extends Stack {
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


//@ts-ignore
describe( 'MessageStack', () => {
    const app = new App()
    const buildConfig: BuildConfig = {
        awsAccountId: '698852667105',
        environment: 'Prod',
        region: 'us-east-1',
        appName: 'MessageTest'
    }

    const stack = new TestMessageStack( app, 'MessageStack', buildConfig, {
        env: {
            account: buildConfig.awsAccountId,
            region: buildConfig.region
        }
    } )

    const template = Template.fromStack( stack )

    const s3KeyId = getLogicalId( stack, stack.messageConstruct.s3Cmk )

    //@ts-ignore
    test( 'should have S3 encryption with KMS', () => {
        template.hasResourceProperties( 'AWS::S3::Bucket', {
            BucketEncryption: {
                ServerSideEncryptionConfiguration: [ {
                    ServerSideEncryptionByDefault: {
                        KMSMasterKeyID: {
                            'Fn::GetAtt': [
                                s3KeyId,
                                'Arn'
                            ]
                        },
                        SSEAlgorithm: 'aws:kms'
                    }
                } ]
            }
        } )
    } )

    //@ts-ignore
    test( 'should have 2 S3 Buckets', () => {
        template.resourceCountIs( 'AWS::S3::Bucket', 2 )
    } )

    const sqsKeyId = getLogicalId( stack, stack.messageConstruct.sqsCmk )

    //@ts-ignore
    test( 'should have SQS encryption with KMS', () => {
        template.hasResourceProperties( 'AWS::SQS::Queue', {
            KmsMasterKeyId: {
                'Fn::GetAtt': [
                    sqsKeyId,
                    'Arn'
                ]
            }
        } )
    } )

    //@ts-ignore
    test( 'should have 2 SQS Queues', () => {
        template.resourceCountIs( 'AWS::SQS::Queue', 2 )
    } )


    const dlLogicalId = getLogicalId( stack, stack.messageConstruct.dlQueue )

    //@ts-ignore
    test( 'should have DL queue configured on Message Queue', () => {
        template.hasResourceProperties( 'AWS::SQS::Queue', {
            QueueName: 'MessageTestMessageQueueProd',
            RedrivePolicy: {
                deadLetterTargetArn: {
                    'Fn::GetAtt': [
                        dlLogicalId,
                        'Arn'
                    ]
                }
            }
        } )
    } )


    // //@ts-ignore
    // test( '', () => {

    // } )
} )