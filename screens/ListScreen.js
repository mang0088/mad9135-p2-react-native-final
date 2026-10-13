import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  TouchableHighlight,
} from 'react-native';
import { useState, useEffect, useRef, useCallback } from 'react';
import ListItem from './ListItem';

const APIKEY = '5782988b879f48a49193d80c856ef1e8';

function ListScreen({ navigation }) {
  const [list, setList] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Guards against stale responses overwriting newer ones or updating state
  // after the screen has unmounted.
  const requestIdRef = useRef(0);

  const fetchRecipes = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    setLoading(true);
    setError(null);

    try {
      const url = `https://api.spoonacular.com/recipes/search?apiKey=${APIKEY}&query=${encodeURIComponent(
        search
      )}`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      const data = await res.json();

      if (requestId !== requestIdRef.current) return;

      setList(Array.isArray(data.results) ? data.results : []);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.log('Failed to load recipes:', err.message);
      setError('Could not load recipes. Please check your connection and try again.');
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [search]);

  // Initial load only. Subsequent searches are triggered by the Search button
  // so typing does not fire a request per keystroke.
  useEffect(() => {
    fetchRecipes();

    return () => {
      requestIdRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderResults = () => {
    if (loading) {
      return (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text style={styles.stateText}>Loading recipes…</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.stateContainer}>
          <Text style={styles.stateText}>{error}</Text>
          <TouchableHighlight
            activeOpacity={0.9}
            style={styles.button}
            underlayColor="#D63113"
            onPress={fetchRecipes}
          >
            <Text style={styles.buttonText}>Retry</Text>
          </TouchableHighlight>
        </View>
      );
    }

    if (list.length === 0) {
      return (
        <View style={styles.stateContainer}>
          <Text style={styles.stateText}>No recipes found.</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={list}
        renderItem={({ item }) => (
          <ListItem
            list={item}
            onPress={() => navigation.navigate('Ingredients', { id: item.id })}
          />
        )}
        keyExtractor={(item) => String(item.id)}
      />
    );
  };

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
          onPress={fetchRecipes}
        >
          <Text style={styles.buttonText}>Search</Text>
        </TouchableHighlight>
      </View>

      {renderResults()}
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
  stateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  stateText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
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
