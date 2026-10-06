import { LoginForm } from "@/components/access-ui";
import { authConfig } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default function Login() { return <LoginForm admin configured={!!authConfig()} />; }
