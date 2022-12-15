import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  TouchableHighlight,
} from 'react-native';
import { useState, useEffect } from 'react';
import ListItem from './ListItem';

function ListScreen({ navigation }) {
  const [list, setList] = useState([]);
  const [search, setSearch] = useState([]);

  const handleButtonPress = async () => {
    fetch(
      `https://api.spoonacular.com/recipes/search?apiKey=5782988b879f48a49193d80c856ef1e8&query=${search}/`
    )
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then((data) => {
        setList(data.results);
      })
      .catch((err) => {
        console.log(err);
      });
  };

  useEffect(() => {
    handleButtonPress();
  }, []);

  if (!list) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }
  return (
    <View>
      <View style={styles.inputContainer}>
        <TextInput
          style={{
            height: 40,
            alignSelf: 'center',
            width: '50%',
            borderColor: 'gray',
            borderWidth: 1,
            padding: 10,
            borderRadius: 15,
            fontSize: 18,
            marginTop: 20,
            marginBottom: 10,
          }}
          placeholder="Enter Dish Name"
          value={search}
          onChangeText={(text) => setSearch(text)}
        />
        <TouchableHighlight
          activeOpacity={0.9}
          style={styles.button}
          underlayColor="#D63113"
          onPress={handleButtonPress}
        >
          <Text style={styles.buttonText}>Search</Text>
        </TouchableHighlight>
      </View>

      <FlatList
        data={list}
        renderItem={({ item }) => (
          <ListItem
            list={item}
            onPress={() => navigation.navigate('Ingredients', { id: item.id })}
          />
        )}
        keyExtractor={(item) => item.id}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    tintColor: 'white',
    backgroundColor: '#1071a4',
    padding: 10,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 25,
    paddingLeft: 15,
  },
  buttonText: {
    textAlign: 'center',
    color: 'white',
    fontSize: 18,
  },
  titleText: {
    fontSize: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
});

export default ListScreen;
