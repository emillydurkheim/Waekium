import { StyleSheet, Text, TouchableOpacity, TouchableOpacityProps } from "react-native"
// o ***props herda todas as propriedades do botao(onPress, disabled) 
type ButtonProps = TouchableOpacityProps & {
    label: string
}// props = propriedades que o componente recebe, nesse caso o label (texto do botão) e as propriedades do TouchableOpacity (como onPress, style, etc)
//desestruturação do props, ou seja, pega o label e o resto das propriedades (rest) para passar pro TouchableOpacity
export function Button({ label, ...rest }: ButtonProps ) {
    return (//o rest pega todas as outras props que eu passei 
        <TouchableOpacity style = {style.container} activeOpacity = {0.7} {...rest}> 
            <Text style = {style.buttonText}>{label}</Text>
        </TouchableOpacity>
    )//label é o texto do botão, ...rest sao todas as outras props e o {...rest} aplica essas props no botão
}

const style = StyleSheet.create({
    container: {
        width: "80%",
        height: 55,
        backgroundColor: "#000000",
        alignContent: "center",
        justifyContent: "center",
        alignSelf: "center",
        borderRadius: 40,
        marginTop: 40,
    },
    label: {
        color: "#ffffff",
        fontSize: 14,
        fontWeight: 700,
        justifyContent: "center",
        alignContent: "center",
    },
    buttonText: {
        fontSize: 20,
        color: "#ffffff",
        textAlign: "center",
        fontWeight: "bold",
    }
})