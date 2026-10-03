import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert tone="danger" title="Something went wrong">
      {message}
      {onRetry ? (
        <div className="mt-2">
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}
    </Alert>
  );
}
