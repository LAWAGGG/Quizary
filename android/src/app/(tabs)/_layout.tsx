import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(name: IoniconName) {
  return ({ color, size }: { color: any; size: number }) => (
    <Ionicons name={name} color={color} size={size} />
  );
}

export default function TabsLayout() {
  const { colors, language, fontSizeScale } = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.cardBg,
          borderTopColor: colors.inputBorder,
          borderTopWidth: 1,
          height: 84,
          paddingBottom: 24,
          paddingTop: 8,
          elevation: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 12 * fontSizeScale,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: language === 'ID' ? 'Dashboard' : 'Dashboard',
          tabBarIcon: tabIcon('time-outline'),
        }}
      />

      <Tabs.Screen
        name="join"
        options={{
          title: language === 'ID' ? 'Scan QR' : 'Scan QR',
          tabBarIcon: tabIcon('qr-code-outline'),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: language === 'ID' ? 'Profil' : 'Profile',
          tabBarIcon: tabIcon('person-outline'),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: language === 'ID' ? 'Pengaturan' : 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size || 22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
