import { Context, S3ObjectCreatedNotificationEvent } from 'aws-lambda'
import { LambdaLog } from 'lambda-log'

const DEBUG_LOGS: boolean = ( process.env.DEBUG_LOGS == 'true' ) ?? false
const FAILURE_TEST: boolean = ( process.env.FAILURE_TEST == 'true' ) ?? false

const redactLogProperties: string[] = [ 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN' ]

const log = new LambdaLog( {
    tags: [
        'processing-lambda'
    ],
    debug: DEBUG_LOGS,
    replacer( key: string, value: any ) {
        if ( redactLogProperties.includes( key ) ) {
            return 'redacted'
        }
        return value
    },
} )



export async function processMessage( event: S3ObjectCreatedNotificationEvent, context: Context ): Promise<void> {

    log.debug( event as any )
    log.debug( context as any )

    if ( FAILURE_TEST ) {
        throw new Error( 'Testing failure for DL Queue' )
    }

    // Insert processing logic here

}