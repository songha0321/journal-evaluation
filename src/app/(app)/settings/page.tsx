import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/PageHeader";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <>
      <PageHeader title="환경설정" desc="이 브라우저에만 저장됩니다. 다른 기기에서는 기본값으로 보입니다" />
      <div className="page-body">
        <SettingsForm user={user} />
      </div>
    </>
  );
}
