import { useAuth } from "@/contexts/AuthContext";

export function useIsAdmin() {
  const { userRole } = useAuth();
  return userRole === "admin";
}
