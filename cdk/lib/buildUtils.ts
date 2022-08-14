import * as cdk from 'aws-cdk-lib'

export interface BuildConfig {
    awsAccountId: string,
    region: string,
    environment: string,
    appName: string
}


export function getBuildConfig( app: cdk.App ): BuildConfig {
    let env = app.node.tryGetContext( 'config' )
    if ( !env ) {
        throw new Error( 'Missing context variable, pass in `-c config=xxx`' )
    }

    let buildEnv = app.node.tryGetContext( env )

    let buildConfig: BuildConfig = {
        awsAccountId: buildEnv[ 'AwsAccountId' ],
        region: buildEnv[ 'Region' ],
        environment: buildEnv[ 'Environment' ],
        appName: buildEnv[ 'AppName' ]
    }

    return buildConfig
}