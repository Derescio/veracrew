Now I have everything I need. Here's the plan:

Add ENABLE_EMAIL_VERIFICATION=false to .env
In the register route: when the flag is false, auto-set emailVerified = new Date() on user creation and skip the email entirely; return requiresVerification: false in the response
In the register form: branch the redirect based on requiresVerification from the response (/verify-email vs /sign-in?registered=1)
auth.ts needs no change — the emailVerified guard passes naturally for auto-verified users