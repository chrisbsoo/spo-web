import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex-1 flex items-center justify-center py-16">
      <SignIn fallbackRedirectUrl="/dashboard" />
    </div>
  );
}
