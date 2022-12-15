import ListScreen from '../screens/ListScreen';
import Detail from '../screens/Detail';
import { createStackNavigator } from '@react-navigation/stack';

const Stack = createStackNavigator();

const UserStackNavigation = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen name="List" component={ListScreen} />
      <Stack.Screen name="Detail" component={Detail} />
    </Stack.Navigator>
  );
};

export { UserStackNavigation };
