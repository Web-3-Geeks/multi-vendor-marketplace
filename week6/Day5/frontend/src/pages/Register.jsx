import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { toFieldErrors } from "../lib/formErrors";
import { Lock, Mail, User } from "lucide-react";
import AuthLayout from "../components/auth/AuthLayout";
import TextField from "../components/ui/TextField";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";

function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
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
      await register(form.name, form.email, form.password);
      navigate("/login", {
        replace: true,
        state: { registeredEmail: form.email },
      });
    } catch (err) {
      setFieldErrors(toFieldErrors(err.errors));
      if (!err.errors?.length) setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join as a customer. Vendor access is granted by an admin."
      footer={
        <>
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-indigo-600 hover:text-indigo-500"
          >
            Log in
          </Link>
        </>
      }
    >
      <form noValidate className="space-y-5" onSubmit={handleSubmit}>
        <Alert>{formError}</Alert>
        <TextField
          id="name"
          name="name"
          label="Full name"
          icon={User}
          placeholder="John Doe"
          autoComplete="name"
          value={form.name}
          onChange={handleChange}
          error={fieldErrors.name}
        />
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
          placeholder="Create a password"
          autoComplete="new-password"
          hint="At least 8 characters, including a letter and a number."
          value={form.password}
          onChange={handleChange}
          error={fieldErrors.password}
        />
        <Button type="submit" loading={submitting}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}

export default Register;
