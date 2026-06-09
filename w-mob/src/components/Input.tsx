import { TextInput, StyleSheet, TextInputProps } from "react-native"

export function Input({ ...rest }:TextInputProps) {
  return <TextInput style = {style.input} { ...rest } />
}

const style = StyleSheet.create({
  input: {
    width: "100%",
    height: 48,
    borderWidth: 1,
    borderColor: "#c9c9c9",
    borderRadius: 35,
    fontSize: 14,
    paddingLeft: 12,
  },
  text: {
      fontSize: 14,
      textAlign: "center",
      fontFamily: "Cinzel_400Regular",
      marginBottom: 15,
  }
})
