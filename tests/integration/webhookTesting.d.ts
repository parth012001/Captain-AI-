interface TestResult {
    testName: string;
    status: 'PASS' | 'FAIL' | 'SKIP';
    duration: number;
    details: string;
    error?: any;
}
export declare class WebhookTestingSuite {
    private tokenStorageService;
    private webhookRenewalService;
    private testResults;
    constructor();
    /**
     * Run the complete webhook testing suite
     */
    runAllTests(): Promise<TestResult[]>;
    private runTest;
    private testDatabaseConnection;
    private testDatabaseSchema;
    private testTokenEncryption;
    private testServiceInitialization;
    private testGmailServiceForUsers;
    private testWebhookExpirationTracking;
    private testWebhookRenewalLogic;
    private testExpiringWebhooksDetection;
    private testMultiUserWebhookIsolation;
    private testConcurrentWebhookRenewal;
    private testInvalidCredentialHandling;
    private testNetworkErrorRecovery;
    private testWebhookStatusEndpoint;
    private testManualRenewalEndpoint;
    private testLargeUserBaseScenario;
    private testWebhookExpirationEdgeCases;
    private printTestSummary;
    /**
     * Quick health check for production monitoring
     */
    quickHealthCheck(): Promise<{
        healthy: boolean;
        issues: string[];
    }>;
}
export {};
//# sourceMappingURL=webhookTesting.d.ts.map