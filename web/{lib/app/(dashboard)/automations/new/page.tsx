import { AutomationForm } from '@/components/automations/AutomationForm';

export default function NewAutomationPage() {
  return (
    <main className="p-8">
      <h1 className="mx-auto mb-6 max-w-2xl text-xl font-semibold">New Comment Automation</h1>
      <AutomationForm />
    </main>
  );
}
