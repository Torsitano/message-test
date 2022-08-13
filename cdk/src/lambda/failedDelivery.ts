import { ReceiveMessageCommand, SQSClient, Message } from '@aws-sdk/client-sqs'
import { Context } from 'aws-lambda'
import { LambdaLog } from 'lambda-log'

const DEBUG_LOGS: boolean = ( process.env.DEBUG_LOGS == 'true' ) ?? false
const DELIVERY_BUCKET = process.env.DELIVERY_BUCKET
const FAILURE_BUCKET = process.env.FAILURE_BUCKET
const DL_QUEUE_URL = process.env.DL_QUEUE_URL
const REGION = process.env.REGION ?? 'us-east-1'

const redactLogProperties: string[] = [ 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN' ]

const log = new LambdaLog( {
    tags: [
        'processing-lambda'
    ],
    debug: DEBUG_LOGS,
    replacer( key: string, value: any ): any {
        if ( redactLogProperties.includes( key ) ) {
            return 'redacted'
        }
        return value
    },
} )

const sqs = new SQSClient( {
    region: REGION
} )



export async function handler( event: any, context: Context ): Promise<void> {
    log.debug( event as any )
    log.debug( context as any )

    if ( !DELIVERY_BUCKET || !FAILURE_BUCKET || !DL_QUEUE_URL ) {
        throw new Error( 'Missing required environment variables' )
    }

    const messages = await receiveMessages()

    while ( messages.Messages ) {
        const messageList = messages.Messages

        await Promise.all( messageList.map( ( message: Message ): void => {
            log.debug( message as any )
        } ) )
    }




}


async function receiveMessages() {
    const command = new ReceiveMessageCommand( {
        QueueUrl: DL_QUEUE_URL,
        MaxNumberOfMessages: 10
    } )

    return sqs.send( command )
}