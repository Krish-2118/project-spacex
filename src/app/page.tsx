import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="container">
      <h1 className="title">Project SpaceX</h1>
      <p className="description">
        Welcome to your new Next.js application. Built with premium design standards, 
        smooth animations, and a beautiful dark mode foundation.
      </p>
      <Link href="https://nextjs.org/docs" className="button" target="_blank" rel="noopener noreferrer">
        Explore Documentation
      </Link>
    </main>
  );
}
