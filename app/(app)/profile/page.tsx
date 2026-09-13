import { prisma } from "@/lib/db";
import ProfileForm from "./ProfileForm";
import TermsTemplatesManager from "./TermsTemplatesManager";

export default async function ProfilePage() {
  const [profile, templates] = await Promise.all([
    prisma.businessProfile.findUnique({ where: { id: "singleton" } }),
    prisma.quotationTermsTemplate.findMany({ orderBy: { name: "asc" } }),
  ]);

  const resolvedProfile = profile ?? {
    logoDataUrl: null,
    name: "",
    ssmNumber: "",
    address: "",
    phone: "",
    email: "",
    bankDetailsText: "",
  };

  return (
    <div className="space-y-6">
      <h1 className="page-title">Business Profile</h1>
      <ProfileForm
        profile={{
          logoDataUrl: resolvedProfile.logoDataUrl,
          name: resolvedProfile.name,
          ssmNumber: resolvedProfile.ssmNumber,
          address: resolvedProfile.address,
          phone: resolvedProfile.phone,
          email: resolvedProfile.email,
          bankDetailsText: resolvedProfile.bankDetailsText,
        }}
      />

      <TermsTemplatesManager templates={templates} />
    </div>
  );
}
