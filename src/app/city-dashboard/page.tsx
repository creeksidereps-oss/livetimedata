import CityDashboardClient from "./ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function CityDashboardPage(props: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return <CityDashboardClient params={props.params} searchParams={props.searchParams} />;
}