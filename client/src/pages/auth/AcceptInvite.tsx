import AcceptInviteForm from '../../components/forms/AcceptInviteForm';
import AuthPageLayout from '../../layouts/AuthPageLayout';

export default function AcceptInvite() {
  return (
    <AuthPageLayout 
      title="You've been invited to the camp" 
      showLogo={true}
      icon="/chat-people.svg"
      iconTransformY="20%"
    >
      <AcceptInviteForm />
    </AuthPageLayout>
  );
}
