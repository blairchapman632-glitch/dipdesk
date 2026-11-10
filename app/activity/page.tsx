import ProfileDashboard from '../dashboard/ProfileDashboard'

// Notifications (♡). Same component, data, cache and logic as the profile — Activity view only.
export default function ActivityPage() {
  return <ProfileDashboard mode="activity" />
}
