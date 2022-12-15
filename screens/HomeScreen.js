import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  Dimensions,
  TextInput,
  TouchableHighlight,
  ActivityIndicator,
  Alert,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useState, useEffect } from 'react';

export default function HomeScreen() {
  const [isConnected, setIsConnected] = useState(false);
  const [lat, setLat] = useState('45.424721');
  const [long, setLong] = useState('-75.695000');
  const [rest, setRest] = useState([]);
  const [loading, setLoading] = useState(true);
  const APIKEY = 'e409000721f4408fb6a467eabe04f80d';

  const handleButtonPress = async () => {
    fetch(
      `https://api.spoonacular.com/food/restaurants/search?lat=${lat}&lng=${long}&apiKey=${APIKEY}`
    )
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then((data) => {
        setRest(data.restaurants);
      })
      .catch((err) => {
        console.log(err);
      });
    setLoading(false);
  };

  useEffect(() => {
    NetInfo.fetch().then((state) => {
      console.log('Connection type', state.type);
      console.log('Is connected?', state.isConnected);
    });

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected === false) {
        Alert.alert('You are offline!');
      } else {
        Alert.alert('You are connected to ' + state.type + ' !');
      }
      setIsConnected(state.isConnected);
    });

    // Unsubscribe
    unsubscribe();
    handleButtonPress();
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#0000ff" />
      </View>
    );
  } else {
    return (
      <View>
        <View style={styles.inputContainer}>
          <Text style={styles.titleText}>Latitude:</Text>
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
            placeholder="Enter Latitude"
            value={lat}
            onChangeText={(text) => setLat(text)}
          />
        </View>
        <View style={styles.inputContainer}>
          <Text style={styles.titleText}>Longitude:</Text>
          <TextInput
            style={{
              height: 40,
              width: '50%',
              borderColor: 'gray',
              borderWidth: 1,
              padding: 10,
              fontSize: 18,
              alignSelf: 'center',
              marginTop: 20,
              marginBottom: 20,
              borderRadius: 15,
            }}
            placeholder="Enter Logitude"
            value={long}
            onChangeText={(text) => setLong(text)}
          />
        </View>
        <TouchableHighlight
          activeOpacity={0.9}
          style={styles.button}
          underlayColor="#D63113"
          onPress={handleButtonPress}
        >
          <Text style={styles.buttonText}>Submit</Text>
        </TouchableHighlight>

        <View style={styles.container}>
          <FlatList
            data={rest}
            renderItem={({ item }) => (
              <View style={styles.cardContainer}>
                <Image
                  style={styles.imageStyle}
                  source={
                    item.logo_photos
                      ? { uri: `${item.logo_photos}` }
                      : require('../assets/placeholder.png')
                  }
                />
                <View style={styles.infoStyle}>
                  <Text style={styles.titleStyle}>{item.name}</Text>
                  <View style={styles.lineStyle} />
                  <Text style={styles.categoryStyle}>
                    <Text style={{ fontWeight: '500' }}>Address </Text>{' '}
                    {item.address.street_addr} {item.address.city}{' '}
                    {item.address.state}
                  </Text>
                  <Text style={styles.categoryStyle}>
                    <Text style={{ fontWeight: '500' }}>Contact No: </Text>{' '}
                    {item.phone_number}
                  </Text>
                </View>
              </View>
            )}
            keyExtractor={(item) => item._id}
          />
        </View>
      </View>
    );
  }
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
    marginBottom: 20,
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
  button: {
    alignItems: 'center',
    tintColor: 'white',
    backgroundColor: '#1071a4',
    padding: 10,
    marginLeft: 40,
    marginRight: 40,
    marginBottom: 20,
  },
  buttonText: {
    color: 'white',
    marginLeft: 20,
    fontSize: 18,
  },
  titleText: {
    marginLeft: 20,
    fontSize: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
});
