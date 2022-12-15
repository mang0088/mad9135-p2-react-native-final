import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useState, useEffect } from 'react';

function DetailScreen({ route }) {
  const id = route.params.id;
  const [details, setDetails] = useState([]);
  const APIKEY = '5782988b879f48a49193d80c856ef1e8';
  useEffect(() => {
    fetch(
      `https://api.spoonacular.com/recipes/${id}/ingredientWidget.json?apiKey=${APIKEY}`
    )
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then((data) => {
        setDetails(data.ingredients);
      })
      .catch((err) => {
        console.log(err);
      });
  }, []);

  if (!details) {
    <View>
      <ActivityIndicator />
    </View>;
  }
  return (
    <View style={styles.container}>
      <FlatList
        data={details}
        renderItem={({ item }) => (
          <View style={styles.cardContainer}>
            <Image
              style={styles.imageStyle}
              source={{
                uri: `https://spoonacular.com/cdn/ingredients_250x250/${item.image}`,
              }}
            />
            <View style={styles.infoStyle}>
              <Text style={styles.titleStyle}>{item.name}</Text>
              <View style={styles.lineStyle} />
              <Text style={styles.categoryStyle}>
                <Text style={{ fontWeight: '500' }}>Metric: </Text>{' '}
                {item.amount.metric.value} {item.amount.metric.unit}
              </Text>
              <Text style={styles.categoryStyle}>
                <Text style={{ fontWeight: '500' }}>Us: </Text>{' '}
                {item.amount.us.value} {item.amount.us.unit}
              </Text>
            </View>
          </View>
        )}
        keyExtractor={(item) => item.name}
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
