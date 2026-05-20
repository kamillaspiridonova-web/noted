import { useEffect, useRef, useState } from "react";
import {
  ClerkProvider,
  SignIn,
  SignUp,
  Show,
  ClerkLoading,
  ClerkLoaded,
  useAuth,
  useClerk,
} from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter, useParams, Redirect, Link } from "wouter";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import AccountPage from "@/pages/AccountPage";
import NotebookView from "@/pages/NotebookView";
import DocumentView from "@/pages/DocumentView";
import { useGetNotebook, getGetNotebookQueryKey } from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import { ThemeProvider } from "@/hooks/use-theme";

// In production, VITE_CLERK_PROXY_URL is auto-set and publishableKeyFromHost
// resolves the correct key for the deployed custom domain. In dev the proxy
// URL is empty, so we use the env key directly to avoid Clerk trying to route
// through the proxy (which only works for live instances).
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL as string | undefined;

const clerkPubKey = clerkProxyUrl
  ? publishableKeyFromHost(
      window.location.hostname,
      import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
    )
  : (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string);

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Clerk passes full paths to routerPush/routerReplace, but wouter's
// setLocation prepends the base — strip it to avoid doubling.
function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#1c1917",
    colorForeground: "#1c1917",
    colorMutedForeground: "#78716c",
    colorDanger: "#dc2626",
    colorBackground: "#ffffff",
    colorInput: "#f5f4f2",
    colorInputForeground: "#1c1917",
    colorNeutral: "#d6d3d1",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    borderRadius: "10px",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-lg border border-stone-100",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-stone-900 font-semibold",
    headerSubtitle: "text-stone-500",
    socialButtonsBlockButtonText: "text-stone-700",
    formFieldLabel: "text-stone-700",
    footerActionLink: "text-stone-900 font-medium hover:text-stone-700",
    footerActionText: "text-stone-500",
    dividerText: "text-stone-400",
    identityPreviewEditButton: "text-stone-900",
    formFieldSuccessText: "text-green-600",
    alertText: "text-stone-700",
    logoBox: "flex justify-center",
    logoImage: "h-10 w-10 rounded-xl",
    socialButtonsBlockButton: "border border-stone-200 hover:bg-stone-50",
    formButtonPrimary: "bg-stone-900 hover:bg-stone-800 text-white",
    formFieldInput: "border-stone-200 bg-stone-50 text-stone-900",
    footerAction: "bg-stone-50",
    dividerLine: "bg-stone-200",
    alert: "border-stone-200",
    otpCodeFieldInput: "border-stone-200",
    formFieldRow: "",
    main: "",
  },
};

function DevAuthPlaceholder({ mode }: { mode: "sign-in" | "sign-up" }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#faf9f7] px-4">
      <div className="bg-white rounded-2xl w-[440px] max-w-full p-8 shadow-lg border border-stone-100 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-stone-900 shadow mx-auto">
          <span className="text-2xl font-bold text-white">N</span>
        </div>
        <h2 className="text-xl font-semibold text-stone-900 mb-2">
          {mode === "sign-in" ? "Sign in to Noted" : "Create your account"}
        </h2>
        <p className="text-stone-500 text-sm mb-6">
          Authentication is active in the published app.
          <br />
          Publish to try signing in.
        </p>
        <Link href="/" className="text-stone-500 text-sm hover:text-stone-700 underline underline-offset-2">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}

function SignInPage() {
  if (IS_DEV_BUILD) return <DevAuthPlaceholder mode="sign-in" />;
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#faf9f7] px-4">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        appearance={clerkAppearance}
      />
    </div>
  );
}

function SignUpPage() {
  if (IS_DEV_BUILD) return <DevAuthPlaceholder mode="sign-up" />;
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#faf9f7] px-4">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        appearance={clerkAppearance}
      />
    </div>
  );
}

function LandingPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#faf9f7] px-6 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-900 shadow-lg">
        <span className="text-3xl font-bold text-white">N</span>
      </div>
      <h1 className="mb-2 text-3xl font-bold text-stone-900">Noted</h1>
      <p className="mb-8 max-w-sm text-stone-500 text-balance">
        Your private space to capture thoughts, notes, and ideas — in a familiar chat-style interface.
      </p>
      <div className="flex gap-3">
        <Button asChild className="bg-stone-900 text-white hover:bg-stone-800 rounded-xl px-6">
          <Link href="/sign-in">Sign in</Link>
        </Button>
        <Button asChild variant="outline" className="border-stone-200 text-stone-700 rounded-xl px-6">
          <Link href="/sign-up">Create account</Link>
        </Button>
      </div>
    </div>
  );
}

// In Vite dev mode, Clerk can't connect to clerk.localhost from Replit's
// browser preview (ERR_CONNECTION_REFUSED). Skip the loading wait entirely
// so the UI is immediately explorable. In production builds, Clerk loads
// quickly via the proxy and the real auth state is used.
const IS_DEV_BUILD = import.meta.env.DEV;

function useClerkReadyOrTimeout(ms = 3000) {
  const { isLoaded, userId } = useAuth();
  // In dev, treat as already timed out so we render immediately without Clerk
  const [timedOut, setTimedOut] = useState(IS_DEV_BUILD);

  useEffect(() => {
    if (isLoaded || IS_DEV_BUILD) return;
    const t = setTimeout(() => setTimedOut(true), ms);
    return () => clearTimeout(t);
  }, [isLoaded]);

  return { isLoaded, userId, timedOut };
}

function AuthLoading() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#faf9f7]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-700" />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function NotebookPage() {
  const { id: rawId } = useParams<{ id: string }>();
  const id = parseInt(rawId ?? "0", 10);

  const { data: notebook, isLoading } = useGetNotebook(id, {
    query: { queryKey: getGetNotebookQueryKey(id), enabled: !!id },
  });

  if (isLoading || !notebook) return <NotebookView />;
  if (notebook.type === "document") return <DocumentView />;
  return <NotebookView />;
}

function ProtectedNotebookPage() {
  const { isLoaded, userId, timedOut } = useClerkReadyOrTimeout();

  if (!isLoaded && !timedOut) return <AuthLoading />;
  if (isLoaded && userId) return <NotebookPage />;
  return <Redirect to="/sign-in" />;
}

function AccountRoute() {
  const { isLoaded, userId, timedOut } = useClerkReadyOrTimeout();

  if (!isLoaded && !timedOut) return <AuthLoading />;
  if (isLoaded && userId) return <AccountPage />;
  return <Redirect to="/sign-in" />;
}

function HomeRoute() {
  const { isLoaded, userId, timedOut } = useClerkReadyOrTimeout();

  if (!isLoaded && !timedOut) return <AuthLoading />;
  if (isLoaded && userId) return <Home />;
  return <LandingPage />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRoute} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/account/*?" component={AccountRoute} />
      <Route path="/notebooks/:id" component={ProtectedNotebookPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey!}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to your Noted account",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Start capturing your ideas in Noted",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
    </ThemeProvider>
  );
}

export default App;
