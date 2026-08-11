import { prisma } from "@/lib/db";
import ProfileForm from "./ProfileForm";

export default async function ProfilePage() {
  const profile = (await prisma.businessProfile.findUnique({
    where: { id: "singleton" },
  })) ?? {
    logoDataUrl: null,
    name: "",
    ssmNumber: "",
    address: "",
    phone: "",
    email: "",
    bankDetailsText: "",
    quotationTerms: "",
  };

  return (
    <div>
      <h1 className="h1-ledger mb-6">Business Profile</h1>
      <ProfileForm
        profile={{
          logoDataUrl: profile.logoDataUrl,
          name: profile.name,
          ssmNumber: profile.ssmNumber,
          address: profile.address,
          phone: profile.phone,
          email: profile.email,
          bankDetailsText: profile.bankDetailsText,
          quotationTerms: profile.quotationTerms,
        }}
      />
    </div>
  );
}
