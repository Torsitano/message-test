import { BuildConfig } from './../lib/buildUtils'
import { Template } from 'aws-cdk-lib/assertions'
import { App, CfnElement, IResource, Stack } from 'aws-cdk-lib'
import { MessageStack } from '../lib/stacks/MessageStack'



function getLogicalId( stack: Stack, resource: IResource ) {
    return stack.getLogicalId( resource.node.findChild( 'Resource' ) as CfnElement )
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

    const stack = new MessageStack( app, 'MessageStack', buildConfig, {
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