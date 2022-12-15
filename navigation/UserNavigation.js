import ListScreen from '../screens/ListScreen';
import Detail from '../screens/Detail';
import { createStackNavigator } from '@react-navigation/stack';

const Stack = createStackNavigator();

const UserStackNavigation = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Recipe" component={ListScreen} />
      <Stack.Screen name="Ingredients" component={Detail} />
    </Stack.Navigator>
  );
};

export { UserStackNavigation };
