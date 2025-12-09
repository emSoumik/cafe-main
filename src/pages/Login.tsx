import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Send, Lock } from "lucide-react";

const Login = () => {
    const [chatId, setChatId] = useState("");
    const [otp, setOtp] = useState("");
    const [step, setStep] = useState<"request" | "verify">("request");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatId) {
            toast.error("Please enter your Telegram Chat ID");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("http://localhost:4001/auth/telegram/otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chatId }),
            });
            const data = await res.json();

            if (data.success) {
                toast.success("OTP sent to your Telegram!");
                setStep("verify");
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
                body: JSON.stringify({ chatId, code: otp }),
            });
            const data = await res.json();

            if (data.success) {
                toast.success("Login successful!");
                // Store token if needed, e.g., localStorage.setItem("token", data.token);
                navigate("/");
            } else {
                toast.error(data.message || "Invalid OTP");
            }
        } catch (error) {
            toast.error("Failed to connect to server");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold text-center">Telegram Login</CardTitle>
                    <CardDescription className="text-center">
                        {step === "request"
                            ? "Enter your Telegram Chat ID to receive an OTP"
                            : "Enter the code sent to your Telegram"}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {step === "request" ? (
                        <form onSubmit={handleSendOtp} className="space-y-4">
                            <div className="space-y-2">
                                <Input
                                    type="text"
                                    placeholder="Telegram Chat ID"
                                    value={chatId}
                                    onChange={(e) => setChatId(e.target.value)}
                                    disabled={loading}
                                />
                                <p className="text-xs text-muted-foreground text-center">
                                    Don't know your Chat ID? Message <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="text-primary hover:underline">@userinfobot</a>
                                </p>
                            </div>
                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? "Sending..." : (
                                    <>
                                        <Send className="mr-2 h-4 w-4" /> Send OTP
                                    </>
                                )}
                            </Button>
                        </form>
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
                                onClick={() => setStep("request")}
                                disabled={loading}
                            >
                                Back
                            </Button>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default Login;
