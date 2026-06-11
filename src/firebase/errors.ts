export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
  public readonly context: SecurityRuleContext;
  public readonly firestoreStackTrace: string;

  constructor(context: SecurityRuleContext) {
    const message = `FirestoreError: Missing or insufficient permissions: The following request was denied by Firestore Security Rules: \n${JSON.stringify(
      {
        context,
      },
      null,
      2
    )}`;
    super(message);
    this.name = 'FirestorePermissionError';
    this.context = context;

    // This captures the stack trace in V8 environments (Chrome, Node.js)
    if ((Error as any).captureStackTrace) {
      (Error as any).captureStackTrace(this, FirestorePermissionError);
    } else {
      this.stack = new Error(message).stack;
    }

    // Simulate getting a richer trace from a hypothetical async operation tracker
    this.firestoreStackTrace = this.getAsyncStackTrace();
  }

  private getAsyncStackTrace(): string {
    // In a real scenario, this might hook into a custom async context management
    // library to provide a more meaningful trace across async boundaries.
    // For this simulation, we'll just return a placeholder.
    return `
    at Firestore operation: ${this.context.operation} on ${this.context.path}
    at Client application logic (e.g., inside a 'saveDocument' function)
    at User action handler (e.g., 'onClick' in a React component)`;
  }
}
