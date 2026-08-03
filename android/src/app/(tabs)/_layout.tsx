import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(name: IoniconName) {
  return ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={name} color={color} size={size} />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E2E8F0',
          borderTopWidth: 1,
          height: 90,
          paddingBottom: 32,
          paddingTop: 12,
          elevation: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
        },
        tabBarActiveTintColor: '#6366F1',
        tabBarInactiveTintColor: '#94A3B8',
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Dashboard',
          tabBarIcon: tabIcon('grid-outline'),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Forms',
          tabBarIcon: tabIcon('document-text-outline'),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'New Form',
          tabBarIcon: tabIcon('add-circle-outline'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: tabIcon('person-outline'),
        }}
      />

      {/* Hidden from Creator Tab Bar – used specifically for Respondent / Guest Flow */}
      <Tabs.Screen
        name="join"
        options={{ href: null }}
      />

      {/* Hidden from Tab Bar – navigated programmatically for taking quiz */}
      <Tabs.Screen
        name="quiz"
        options={{ href: null }}
      />
    </Tabs>
  );
}
