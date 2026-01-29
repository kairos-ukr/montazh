import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  FaEye,
  FaEyeSlash,
  FaUser,
  FaLock,
  FaEnvelope,
  FaSignInAlt,
  FaUserPlus,
  FaCheckCircle,
  FaExclamationTriangle,
} from "react-icons/fa";

// ✅ лишаємо твій дизайн/лого як було
import logoImg from "../assets/logo.png";

// ✅ беремо бекенд-клієнт (твій http.js)
import { apiPost } from "../api/http";

// ✅ беремо авторизацію з контексту (AuthProvider)
import { useAuth } from "../context/AuthProvider";

// Компонент поля вводу (без змін по дизайну)
const InputField = ({
  name,
  type,
  placeholder,
  value,
  onChange,
  icon,
  disabled,
  required = true,
  minLength,
}) => (
  <div className="relative group">
    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors duration-300">
      {icon}
    </span>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      minLength={minLength}
      className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 shadow-sm text-slate-800 placeholder-slate-400"
    />
  </div>
);

// Компонент перевірки пароля (без змін по дизайну)
const PasswordPolicy = ({ password }) => {
  const checks = {
    length: password.length >= 8,
    number: /\d/.test(password),
    specialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };

  const Requirement = ({ text, met }) => (
    <div
      className={`flex items-center text-xs transition-colors duration-300 ${
        met ? "text-emerald-600" : "text-slate-500"
      }`}
    >
      {met ? (
        <FaCheckCircle className="mr-2" />
      ) : (
        <FaExclamationTriangle className="mr-2" />
      )}
      <span>{text}</span>
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
      <Requirement text="Мінімум 8 символів" met={checks.length} />
      <Requirement text="Містить хоча б одну цифру" met={checks.number} />
      <Requirement text="Містить спецсимвол (!@#...)" met={checks.specialChar} />
    </div>
  );
};

export default function AuthPage() {
  const navigate = useNavigate();

  // ✅ реальний auth-стан з провайдера
  const { user, isLoading: authLoading, signIn } = useAuth();

  const [isSignIn, setIsSignIn] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // ✅ окремо “відправка форми”, щоб не ламати UX
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  // ✅ якщо вже залогінений — одразу в /home (без циклів)
  useEffect(() => {
    if (!authLoading && user) {
      navigate("/home", { replace: true });
    }
  }, [authLoading, user, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
    if (error) setError("");
    if (successMessage) setSuccessMessage("");
  };

  const resetUi = () => {
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
    });
    setError("");
    setSuccessMessage("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const toggleMode = () => {
    setIsSignIn((p) => !p);
    resetUi();
  };

  const validateSignUp = () => {
    if (formData.password !== formData.confirmPassword) {
      return "Паролі не співпадають.";
    }
    const passwordIsValid =
      formData.password.length >= 8 &&
      /\d/.test(formData.password) &&
      /[!@#$%^&*(),.?":{}|<>]/.test(formData.password);

    if (!passwordIsValid) return "Пароль не відповідає вимогам безпеки.";
    return "";
  };

  const mapErrorMessage = (raw) => {
    const msg = raw || "Сталася невідома помилка.";
    const lower = msg.toLowerCase();

    if (lower.includes("already") || lower.includes("registered") || lower.includes("exists")) {
      return "Користувач з такою поштою вже існує.";
    }
    if (lower.includes("invalid") || lower.includes("credentials")) {
      return "Невірна пошта або пароль.";
    }
    if (lower.includes("confirm") && lower.includes("email")) {
      return "Підтвердіть пошту, а потім увійдіть в акаунт.";
    }
    return msg;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!isSignIn) {
      const v = validateSignUp();
      if (v) {
        setError(v);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (!isSignIn) {
        // ✅ Реєстрація через бекенд
        const resp = await apiPost("/api/auth/sign-up", {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password: formData.password,
        });

        // Якщо Supabase вимагає підтвердження пошти — просто показуємо повідомлення
        if (resp?.needsEmailConfirmation) {
          setSuccessMessage(
            "Реєстрація успішна! Підтвердіть свою пошту та увійдіть в акаунт."
          );
          setIsSignIn(true);
          return;
        }

        // Якщо підтвердження не треба — одразу входимо
        await signIn(formData.email, formData.password);
        navigate("/home", { replace: true });
      } else {
        // ✅ Вхід через AuthProvider (він поставить cookies і оновить user)
        await signIn(formData.email, formData.password);
        navigate("/home", { replace: true });
      }
    } catch (err) {
      setError(mapErrorMessage(err?.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ Поки AuthProvider перевіряє сесію — показуємо твій loader (як було)
  if (authLoading && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <img
          src={logoImg}
          alt="Loading..."
          className="w-16 h-16 object-contain animate-pulse drop-shadow-lg"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans flex items-center justify-center p-4">
      {/* Залишаємо overflow-visible як у твоєму дизайні */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 relative overflow-visible">
        {/* Хедер як було */}
        <div className="h-40 bg-gradient-to-br from-slate-800 to-blue-900 flex items-center justify-center relative rounded-t-2xl">
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden rounded-t-2xl">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
          </div>

          {/* Лого як було */}
          <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center shadow-2xl absolute -bottom-12 border-4 border-white z-10 transform rotate-3 transition-transform hover:rotate-0">
            <img
              src={logoImg}
              alt="K-Core Logo"
              className="w-16 h-16 object-contain filter drop-shadow-md"
            />
          </div>
        </div>

        <div className="p-8 pt-16">
          <AnimatePresence mode="wait">
            <motion.div
              key={isSignIn ? "signIn" : "signUp"}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="w-full"
            >
              <h2 className="text-3xl font-bold text-slate-800 mb-2 text-center tracking-tight">
                {isSignIn ? "Kairos-Core System" : "Реєстрація"}
              </h2>
              <p className="text-sm text-slate-500 mb-8 text-center">
                {isSignIn
                  ? "Увійдіть, щоб керувати енергією"
                  : "Приєднуйтесь до платформи майбутнього"}
              </p>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r-lg mb-6 text-sm font-medium shadow-sm"
                >
                  {error}
                </motion.div>
              )}

              {successMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 px-4 py-3 rounded-r-lg mb-6 text-sm font-medium shadow-sm"
                >
                  {successMessage}
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {!isSignIn && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InputField
                      name="firstName"
                      type="text"
                      placeholder="Ім'я"
                      value={formData.firstName}
                      onChange={handleChange}
                      icon={<FaUser />}
                      disabled={isSubmitting}
                    />
                    <InputField
                      name="lastName"
                      type="text"
                      placeholder="Прізвище"
                      value={formData.lastName}
                      onChange={handleChange}
                      icon={<FaUser />}
                      disabled={isSubmitting}
                    />
                  </div>
                )}

                <InputField
                  name="email"
                  type="email"
                  placeholder="Електронна пошта"
                  value={formData.email}
                  onChange={handleChange}
                  icon={<FaEnvelope />}
                  disabled={isSubmitting}
                />

                <div className="relative">
                  <InputField
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Пароль"
                    value={formData.password}
                    onChange={handleChange}
                    icon={<FaLock />}
                    disabled={isSubmitting}
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors focus:outline-none"
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>

                {!isSignIn && (
                  <>
                    <div className="relative">
                      <InputField
                        name="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Підтвердити пароль"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        icon={<FaLock />}
                        disabled={isSubmitting}
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((p) => !p)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors focus:outline-none"
                      >
                        {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>

                    <PasswordPolicy password={formData.password} />
                  </>
                )}

                {isSignIn && (
                  <div className="flex items-center justify-between">
                    <label className="flex items-center text-sm text-slate-600 cursor-pointer hover:text-slate-800 transition-colors">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2">Запам'ятати мене</span>
                    </label>
                  </div>
                )}

                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98, y: 0 }}
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full px-6 py-3.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:from-slate-400 disabled:to-slate-500 text-white rounded-lg font-bold transition-all duration-300 shadow-lg hover:shadow-blue-500/30 text-base tracking-wider flex items-center justify-center space-x-3 mt-6"
                >
                  {isSubmitting ? (
                    <>
                      <svg
                        className="animate-spin h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      <span>ОБРОБКА...</span>
                    </>
                  ) : isSignIn ? (
                    <>
                      <FaSignInAlt />
                      <span>УВІЙТИ</span>
                    </>
                  ) : (
                    <>
                      <FaUserPlus />
                      <span>СТВОРИТИ АКАУНТ</span>
                    </>
                  )}
                </motion.button>
              </form>

              <div className="mt-8 text-center">
                <span className="text-sm text-slate-500">
                  {isSignIn ? "Вперше тут?" : "Вже маєте акаунт?"}
                </span>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleMode}
                  disabled={isSubmitting}
                  className="ml-2 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors focus:outline-none"
                >
                  {isSignIn ? "Зареєструватись" : "Увійти в систему"}
                </motion.button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
