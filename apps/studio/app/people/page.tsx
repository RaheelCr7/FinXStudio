import { PeopleView } from "@/components/PeopleView";
import { listPolicies } from "@/lib/access";
import { listActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";
export default async function PeoplePage() {
  const [policies, activity] = await Promise.all([listPolicies(), listActivity({ limit: 50 })]);
  return <PeopleView policies={policies} activity={activity} />;
}
