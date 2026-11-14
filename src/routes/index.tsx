import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/config/app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	return (
		<main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-6 p-8">
			<h1 className="text-4xl font-bold">{APP_NAME}</h1>
			<Button type="button">Get started</Button>
		</main>
	);
}
