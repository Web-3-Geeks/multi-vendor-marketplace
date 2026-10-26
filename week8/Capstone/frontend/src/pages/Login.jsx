import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ROLE_HOME } from "../constants/roles";
import { toFieldErrors } from "../lib/formErrors";
import { Lock, Mail } from "lucide-react";
import AuthLayout from "../components/auth/AuthLayout";
import TextField from "../components/ui/TextField";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const registeredEmail = location.state?.registeredEmail;
  const [form, setForm] = useState({
    email: registeredEmail || "",
    password: "",
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setFieldErrors({});
    setSubmitting(true);
    try {
      const user = await login(form.email, form.password);
      navigate(ROLE_HOME[user.role], { replace: true });
    } catch (err) {
      setFieldErrors(toFieldErrors(err.errors));
      if (!err.errors?.length) setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to continue to your dashboard."
      footer={
        <>
          New here?{" "}
          <Link
            to="/register"
            className="font-semibold text-indigo-600 hover:text-indigo-500"
          >
            Create an account
          </Link>
        </>
      }
    >
      <form noValidate className="space-y-5" onSubmit={handleSubmit}>
        {registeredEmail && !formError && (
          <Alert variant="success">Account created. Please log in.</Alert>
        )}
        <Alert>{formError}</Alert>
        <TextField
          id="email"
          name="email"
          type="email"
          label="Email"
          icon={Mail}
          placeholder="you@example.com"
          autoComplete="email"
          value={form.email}
          onChange={handleChange}
          error={fieldErrors.email}
        />
        <TextField
          id="password"
          name="password"
          type="password"
          label="Password"
          icon={Lock}
          placeholder="Your password"
          autoComplete="current-password"
          value={form.password}
          onChange={handleChange}
          error={fieldErrors.password}
        />
        <Button type="submit" loading={submitting}>
          Log in
        </Button>
      </form>
    </AuthLayout>
  );
}

export default Login;
