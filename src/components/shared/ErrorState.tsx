import { Alert } from "@/components/ui/Alert";

export function ErrorState({ message }: { message: string }) {
  return (
    <Alert tone="danger" title="Something went wrong">
      {message}
    </Alert>
  );
}
