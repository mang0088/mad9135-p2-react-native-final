import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  TouchableHighlight,
} from 'react-native';

const APIKEY = '5782988b879f48a49193d80c856ef1e8';
const CDN_BASE = 'https://img.spoonacular.com/ingredients_250x250/';

function DetailScreen({ route }) {
  const id = route && route.params ? route.params.id : undefined;
  const [details, setDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      if (id === undefined || id === null) {
        setError('Missing recipe id.');
        setLoading(false);
        return;
      }

      try {
        const url = `https://api.spoonacular.com/recipes/${id}/ingredientWidget.json?apiKey=${APIKEY}`;
        const res = await fetch(url);

        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }

        const data = await res.json();

        if (!active || requestId !== requestIdRef.current) return;

        setDetails(Array.isArray(data.ingredients) ? data.ingredients : []);
      } catch (err) {
        if (!active || requestId !== requestIdRef.current) return;
        console.log('Failed to load ingredients:', err.message);
        setError('Could not load ingredients. Please try again.');
      } finally {
        if (active && requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      active = false;
      requestIdRef.current += 1;
    };
  }, [id]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.stateText}>Loading ingredients…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.stateText}>{error}</Text>
      </View>
    );
  }

  if (details.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.stateText}>No ingredients found for this recipe.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={details}
        renderItem={({ item }) => {
          const metric = item.amount ? item.amount.metric : null;
          const us = item.amount ? item.amount.us : null;

          return (
            <View style={styles.cardContainer}>
              <Image
                style={styles.imageStyle}
                source={{ uri: `${CDN_BASE}${item.image}` }}
              />
              <View style={styles.infoStyle}>
                <Text style={styles.titleStyle}>{item.name}</Text>
                <View style={styles.lineStyle} />
                <Text style={styles.categoryStyle}>
                  <Text style={{ fontWeight: '500' }}>Metric: </Text>{' '}
                  {metric ? `${metric.value} ${metric.unit}` : 'N/A'}
                </Text>
                <Text style={styles.categoryStyle}>
                  <Text style={{ fontWeight: '500' }}>Us: </Text>{' '}
                  {us ? `${us.value} ${us.unit}` : 'N/A'}
                </Text>
              </View>
            </View>
          );
        }}
        keyExtractor={(item, index) => String(item.name || index)}
      />
    </View>
  );
}

const deviceWidth = Math.round(Dimensions.get('window').width);
const offset = 40;
const radius = 20;
const styles = StyleSheet.create({
  container: {
    width: deviceWidth - 20,
    alignItems: 'center',
    marginTop: 25,
    paddingLeft: 15,
  },
  stateText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 15,
  },
  cardContainer: {
    width: deviceWidth - offset,
    backgroundColor: '#2596be',
    height: 360,
    marginTop: 25,
    borderRadius: radius,

    shadowColor: '#000',
    shadowOffset: {
      width: 5,
      height: 5,
    },
    shadowOpacity: 0.75,
    shadowRadius: 5,
    elevation: 9,
  },
  imageStyle: {
    height: 200,
    width: deviceWidth - offset,
    borderTopLeftRadius: radius,
    borderTopRightRadius: radius,
    opacity: 0.9,
    alignContent: 'center',
    alignSelf: 'center',
  },
  lineStyle: {
    borderWidth: 0.5,
    borderColor: 'black',
    margin: 10,
  },
  titleStyle: {
    textAlign: 'center',
    fontFamily: 'Cochin',
    fontSize: 24,
    fontWeight: '800',
  },
  categoryStyle: {
    fontFamily: 'Gill Sans',
    fontSize: 18,
    fontWeight: '300',
    textAlign: 'center',
  },
  infoStyle: {
    marginHorizontal: 10,
    marginVertical: 5,
  },
});

export default DetailScreen;
