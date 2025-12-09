import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Send, Lock } from "lucide-react";

interface AuthModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: (token: string, user: any) => void;
}

const AuthModal = ({ open, onClose, onSuccess }: AuthModalProps) => {
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [step, setStep] = useState<"phone" | "otp">("phone");
    const [loading, setLoading] = useState(false);

    // Check for Google OAuth callback
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('auth') === 'success') {
            const token = params.get('token');
            const userStr = params.get('user');
            if (token && userStr) {
                try {
                    const user = JSON.parse(decodeURIComponent(userStr));
                    onSuccess(token, user);
                    // Clean URL
                    window.history.replaceState({}, '', window.location.pathname);
                    toast.success(`Welcome, ${user.name || user.email}!`);
                } catch (e) {
                    console.error('Failed to parse user data', e);
                }
            }
        }
    }, [onSuccess]);

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phone) {
            toast.error("Please enter your phone number");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("http://localhost:4001/auth/telegram/otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone }),
            });
            const data = await res.json();

            if (data.success) {
                toast.success("OTP sent to your Telegram!");
                setStep("otp");
            } else {
                toast.error(data.message || "Failed to send OTP");
            }
        } catch (error) {
            toast.error("Failed to connect to server");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!otp) {
            toast.error("Please enter the OTP");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("http://localhost:4001/auth/telegram/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone, code: otp }),
            });
            const data = await res.json();

            if (data.success) {
                toast.success("Login successful!");
                onSuccess(data.token, data.user);
                onClose();
            } else {
                toast.error(data.message || "Invalid OTP");
            }
        } catch (error) {
            toast.error("Failed to connect to server");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = () => {
        // Redirect to backend OAuth endpoint
        window.location.href = "http://localhost:4001/auth/google";
    };

    return (
        <Dialog open={open} onOpenChange={(open) => !loading && !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Login to Continue</DialogTitle>
                    <DialogDescription>
                        {step === "phone"
                            ? "Choose your login method"
                            : "Enter the code sent to your Telegram"}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {step === "phone" ? (
                        <>
                            <form onSubmit={handleSendOtp} className="space-y-4">
                                <div className="space-y-2">
                                    <Input
                                        type="tel"
                                        placeholder="Phone number (e.g., +1234567890)"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        disabled={loading}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Make sure you've registered your phone with the Telegram bot first.{" "}
                                        <a href="https://t.me/YOUR_BOT_USERNAME" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                                            Start here
                                        </a>
                                    </p>
                                </div>
                                <Button type="submit" className="w-full" disabled={loading}>
                                    {loading ? "Sending..." : (
                                        <>
                                            <Send className="mr-2 h-4 w-4" /> Send OTP via Telegram
                                        </>
                                    )}
                                </Button>
                            </form>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-background px-2 text-muted-foreground">Or</span>
                                </div>
                            </div>

                            <Button
                                onClick={handleGoogleLogin}
                                variant="outline"
                                className="w-full"
                                disabled={loading}
                            >
                                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                                    <path
                                        fill="currentColor"
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    />
                                    <path
                                        fill="currentColor"
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    />
                                    <path
                                        fill="currentColor"
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    />
                                    <path
                                        fill="currentColor"
                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    />
                                </svg>
                                Continue with Google
                            </Button>
                        </>
                    ) : (
                        <form onSubmit={handleVerifyOtp} className="space-y-4">
                            <div className="space-y-2">
                                <Input
                                    type="text"
                                    placeholder="Enter OTP"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? "Verifying..." : (
                                    <>
                                        <Lock className="mr-2 h-4 w-4" /> Verify & Login
                                    </>
                                )}
                            </Button>
                            <Button
                                variant="ghost"
                                className="w-full"
                                onClick={() => setStep("phone")}
                                disabled={loading}
                            >
                                Back
                            </Button>
                        </form>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default AuthModal;
