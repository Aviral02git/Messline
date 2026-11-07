import Link from "next/link";

export default function NotFound() {
    return (
        <main className="mx-auto max-w-3xl px-6 py-10">
            <h1 className="text-2xl font-semibold">Page not found</h1>
            <p className="mt-2 text-sm leading-6 text-neutral-700">
                The page you are looking for does not exist.
            </p>
            <Link
                href="/"
                className="mt-6 inline-block rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
            >
                Back to home
            </Link>
        </main>
    );
}
